import * as cdk from 'aws-cdk-lib';
import { AuthorizationType, CfnAuthorizer, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { PartitionKey } from 'aws-cdk-lib/aws-appsync';
import { OAuthScope, UserPool, UserPoolClientIdentityProvider, UserPoolDomain } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';

const ORDERS_TABLE_NAME = 'orders';

export class CdkMyshopStack extends cdk.Stack {
  private ordersTable:Table;
  private createOrderLambda:NodejsFunction;
  private getOrdersLambda:NodejsFunction;
  private updateOrderLambda:NodejsFunction;
  private userPool:UserPool;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.createPersistence();
    this.createCompute();
    this.createAuthorization();
    this.createRestAPI();
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
  }
  private createRestAPI():void {
    const api = new RestApi(this, 'shopApi', {
      restApiName: 'Shop API'
    });

    const authorizer = new CfnAuthorizer(this, 'cfnAuth', {
      restApiId: api.restApiId,
      name: 'CognitoAPIAuthorizer',
      type: 'COGNITO_USER_POOLS',
      identitySource: 'method.request.header.Authorization',
      providerArns: [this.userPool.userPoolArn]
    });

    const authorizerOptions:any = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: {
        authorizerId: authorizer.ref
      }
    }
    const ordersResource = api.root.addResource('orders');

    // POST /orders
    ordersResource.addMethod('POST', new LambdaIntegration(this.createOrderLambda), {...authorizerOptions});

    // GET /orders/
    ordersResource.addMethod('GET', new LambdaIntegration(this.getOrdersLambda), {...authorizerOptions});

    // PUT /orders/{order_id}
    const singleOrderResource = ordersResource.addResource('{id}');
    singleOrderResource.addMethod('PUT', new LambdaIntegration(this.updateOrderLambda), {...authorizerOptions});
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
}


