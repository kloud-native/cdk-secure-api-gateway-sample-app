import { DBHandler } from "../handlers/db-handler";
import { EventUtil } from "../utils/event-util";

const TABLE_NAME = process.env.TABLE_NAME??"orders";

export const handler = async(event: any = {}): Promise<any> => {
  console.log('In get order. Table name: ', TABLE_NAME);

  const startDate = event.queryStringParameters.startDate;
  const endDate = event.queryStringParameters.endDate;

  if (!startDate || !endDate) {
    return { statusCode: 400, body: 'Error: You are missing one of the required parameters'};
  }

  const parseEvent = EventUtil.parseEvent(event);
  const dbHandler = new DBHandler(TABLE_NAME);

  try {
    const response = await dbHandler.getOrders(parseEvent.customerID, startDate, endDate);
    if (response) {
      return { statusCode: 200, body: JSON.stringify(response) }
    }
    else {
      return { statusCode: 404 }
    }
  } catch (dbError) {
    return { statusCode: 400, body: JSON.stringify(dbError)}
  }
}