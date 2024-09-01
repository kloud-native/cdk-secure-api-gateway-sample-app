import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument, QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { Order } from "../entities/order";

export class DBHandler {
  readonly dynamoDB: DynamoDBDocument;
  readonly ordersTableName: string;

  constructor(ordersTableName:string) {
    this.dynamoDB = DynamoDBDocument.from(new DynamoDB(),{
      marshallOptions: {
        convertClassInstanceToMap: true
      }
    });

    this.ordersTableName = ordersTableName;
  }

  public putOrder(order:Order) {
    const putParams = {
      TableName: this.ordersTableName,
      Item: order
    };
  
    return this.dynamoDB.put(putParams);  
  }

  public getOrders(customerID:string, startDate: string, endDate: string) {
    const params = {
      TableName: this.ordersTableName,
      KeyConditionExpression: 'customerID = :customer_id AND orderDateISO between :start_date and :end_date',
      ExpressionAttributeValues: {
        ':customer_id': customerID,
        ':start_date': startDate,
        ':end_date': endDate
      }
    };
    return this.dynamoDB.query(params);
  }

  public async getSingleOrder(orderID:string):Promise<Order> {
    const queryResult:QueryCommandOutput = await this.dynamoDB.query({
      TableName: this.ordersTableName,
      KeyConditionExpression: "orderID = :order_id",
      IndexName: "OrderIdIdx",
      ExpressionAttributeValues: {
        ":order_id": orderID
      }
    });
    if (queryResult.Count == 0) {
      throw new Error(`Order with OrderID: ${orderID} not found`);
    }

    return Order.fromDbRecord(queryResult.Items?.at(0));
  }
}