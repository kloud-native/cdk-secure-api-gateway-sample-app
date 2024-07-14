import * as cdk from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { PartitionKey } from 'aws-cdk-lib/aws-appsync';
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

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.createPersistence();
    this.createCompute();
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

    const ordersResource = api.root.addResource('orders');

    // POST /orders
    ordersResource.addMethod('POST', new LambdaIntegration(this.createOrderLambda));

    // GET /orders/
    ordersResource.addMethod('GET', new LambdaIntegration(this.getOrdersLambda));

    // PUT /orders/{order_id}
    const singleOrderResource = ordersResource.addResource('{id}');
    singleOrderResource.addMethod('PUT', new LambdaIntegration(this.updateOrderLambda));
  }
}


