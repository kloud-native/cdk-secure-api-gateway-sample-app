import * as cdk from 'aws-cdk-lib';
import { AuthorizationType, CfnAuthorizer, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { OAuthScope, UserPool, UserPoolClientIdentityProvider, UserPoolDomain } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime, LayerVersion, Function, Code } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

const ORDERS_TABLE_NAME = 'orders';
const SRC_IDENT_SECRET = 'SrcIdent'

export class CdkMyshopStack extends cdk.Stack {
  private ordersTable:Table;
  private createOrderLambda:NodejsFunction;
  private getOrdersLambda:NodejsFunction;
  private updateOrderLambda:NodejsFunction;
  private userPool:UserPool;
  private authorizerLambda:NodejsFunction;
  private api:RestApi;
  public apiGatewayARN:string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.createPersistence();
    this.createAuthorization();
    this.createCompute();
    this.createRestAPI();
    this.createCloudFrontDistribution();

    this.apiGatewayARN = `arn:aws:apigateway:${cdk.Stack.of(this).region}::/restapis/${this.api.restApiId}/stages/${this.api.deploymentStage.stageName}`;

  }
  private createPersistence():void {
    // customerID(pk), orderDateISO(sk), orderID(pk_idx), orderItems
    this.ordersTable = new Table(this, 'orders', {
      partitionKey: {
        name: 'customerID',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'orderDateISO',
        type: AttributeType.STRING
      },
      tableName: ORDERS_TABLE_NAME,
      readCapacity: 2,
      writeCapacity: 2,

      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    this.ordersTable.addGlobalSecondaryIndex({
      indexName: 'OrderIdIdx',
      partitionKey: {
        name: 'orderID',
        type: AttributeType.STRING
      },
      readCapacity: 2,
      writeCapacity: 2
    });
  }
  private createCompute():void {
    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
          'aws-sdk'
        ],
        esbuildVersion: "0.21.5"
      },
      environment: {
        TABLE_NAME: ORDERS_TABLE_NAME
      },
      runtime: Runtime.NODEJS_20_X
    }

    this.createOrderLambda = new NodejsFunction(this,'createOrder', {
      entry: join(__dirname, 'lambdas', 'create-order.ts'),
      ...nodeJsFunctionProps
    });
    this.ordersTable.grantReadWriteData(this.createOrderLambda);

    this.getOrdersLambda = new NodejsFunction(this,'getOrders', {
      entry: join(__dirname, 'lambdas', 'get-orders.ts'),
      ...nodeJsFunctionProps
    });
    this.ordersTable.grantReadData(this.getOrdersLambda);

    this.updateOrderLambda = new NodejsFunction(this,'updateOrder', {
      entry: join(__dirname, 'lambdas', 'update-order.ts'),
      ...nodeJsFunctionProps
    });
    this.ordersTable.grantReadWriteData(this.updateOrderLambda);

    const authorizerFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
          'aws-sdk'
        ],
        esbuildVersion: "0.21.5"
      },
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
      },
      runtime: Runtime.NODEJS_20_X
    };
    this.authorizerLambda = new NodejsFunction(this, 'authorizer',{
      entry: join(__dirname, 'lambdas', 'authorizer.ts'),
      ...authorizerFunctionProps
    });
    this.provideSecretAccessToFunction(this.authorizerLambda);

  }
  private createRestAPI():void {
    this.api = new RestApi(this, 'shopApi', {
      restApiName: 'Shop API',
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL]
      },
    });
      
    const lambdaAuthorizer = new apigateway.RequestAuthorizer(this, 'Authorizer', {
      handler: this.authorizerLambda,
      identitySources: [
        'method.request.header.Authorization',
        'method.request.header.src-ident'
      ],
      resultsCacheTtl: cdk.Duration.seconds(0)
    });

    const ordersResource = this.api.root.addResource('orders');

    const commonMethodOptions = {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: lambdaAuthorizer,
      apiKeyRequired: true
    }
    // POST /orders
    const {requestValidator, orderModel} = this.requestValidatorForCreateOrder();
    ordersResource.addMethod('POST', new LambdaIntegration(this.createOrderLambda), 
      {
        ...commonMethodOptions,
        requestValidator: requestValidator,
        requestModels: { 'application/json': orderModel }
      }
    );

    // GET /orders/
    ordersResource.addMethod('GET', new LambdaIntegration(this.getOrdersLambda), commonMethodOptions);

    // PUT /orders/{order_id}
    const singleOrderResource = ordersResource.addResource('{id}');
    singleOrderResource.addMethod('PUT', new LambdaIntegration(this.updateOrderLambda), commonMethodOptions);

    this.setupAPIUsagePlan();
  }

  private createAuthorization():void {
    this.userPool = new UserPool(this, 'userPool', {
      signInAliases: {
        email: true
      },
      selfSignUpEnabled: true
    });

    const client = this.userPool.addClient('MainAppClient', {
      userPoolClientName: 'MainAppClient',
      oAuth: {
        flows: { implicitCodeGrant: true },
        scopes: [OAuthScope.OPENID],
        callbackUrls: ["https://example.com"]
      },
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.COGNITO,
      ],
      refreshTokenValidity: cdk.Duration.days(1),
      idTokenValidity: cdk.Duration.days(1),
      accessTokenValidity: cdk.Duration.days(1)
    });

    new UserPoolDomain(this, "MyUserPoolDomain", {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: 'my-shop567'
      }
    });
  }

  private setupAPIUsagePlan() {
    const usagePlan = new apigateway.UsagePlan(this, 'MyUsagePlan', {
      name: 'BasicUsagePlan',
      description: 'Usage plan with throttling and quota for all methods.',
      throttle: {
        rateLimit: 100, 
        burstLimit: 200,
      },
      quota: {
        limit: 1000,
        period: apigateway.Period.DAY,
      },
    });

    const apiKey = new apigateway.ApiKey(this, 'MyApiKey', {
      apiKeyName: 'MyAPIKey',
      description: 'API Key for accessing all methods.',
    });
    usagePlan.addApiKey(apiKey);

    usagePlan.addApiStage({
      stage: this.api.deploymentStage
    });
  }
  
  private requestValidatorForCreateOrder() {
    const orderRequestSchema: apigateway.JsonSchema = {
      type: apigateway.JsonSchemaType.OBJECT,
      properties: {
        orderItems: {
          type: apigateway.JsonSchemaType.ARRAY,
          items: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              productID: { type: apigateway.JsonSchemaType.STRING },
              productTitle: { type: apigateway.JsonSchemaType.STRING },
              quantity: { type: apigateway.JsonSchemaType.INTEGER, minimum: 1 },
              productPrice: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0 },
            },
            required: ['productID', 'productTitle', 'quantity', 'productPrice'],
          },
        },
      },
      required: ['orderItems'],
    };

    const orderModel = new apigateway.Model(this, 'OrderModel', {
      restApi: this.api,
      schema: orderRequestSchema,
      contentType: 'application/json',
      modelName: 'OrderRequestModel',
      description: 'Schema model for order requests.',
    });

    const requestValidator = new apigateway.RequestValidator(this, 'OrderRequestValidator', {
      restApi: this.api,
      requestValidatorName: 'ValidateOrderRequestBody',
      validateRequestBody: true,
      validateRequestParameters: false,
    });
    return {
      requestValidator: requestValidator,
      orderModel: orderModel
    }
  }

  private createCloudFrontDistribution() {
    const origin = new cloudfront_origins.HttpOrigin(`${this.api.restApiId}.execute-api.${this.region}.amazonaws.com`, {
      originPath: '/prod',
    });

    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'MyOriginRequestPolicy', {
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList("x-api-key","src-ident"),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
    });

    const injectHeaderFunction = new NodejsFunction(this, 'InjectHeader', {
      // runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, 'lambdas', 'inject-header.js'),
    });
    
    this.provideSecretAccessToFunction(injectHeaderFunction);

    const cachePolicy = new cloudfront.CachePolicy(this, 'MyCachePolicy', {
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Authorization"),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.all(),
      minTtl: cdk.Duration.seconds(0),
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(1),
    });

    const distribution = new cloudfront.Distribution(this, 'CFDistribution', {
      defaultBehavior: {
        origin: origin,
        cachePolicy: cachePolicy,
        originRequestPolicy: originRequestPolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        edgeLambdas: [{
          functionVersion: injectHeaderFunction.currentVersion,
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
        }]
      },
    });

    // Step 4: Grant the CloudFront function access to the secret
    // distribution.node.addDependency(secret);
    // distribution.node.defaultChild?.addToResourcePolicy(secretAccessPolicy);

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.domainName}`,
      description: 'The CloudFront distribution URL.',
    });
  }
  private provideSecretAccessToFunction(nodejsFunction:NodejsFunction) {
    const secretArn = `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${SRC_IDENT_SECRET}*`;
    nodejsFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn],
      })
    );
  }
}



