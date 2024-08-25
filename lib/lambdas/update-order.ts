
const TABLE_NAME = process.env.TABLE_NAME??"orders";

export const handler = async(event: any = {}): Promise<any> => {
  console.log('In update order. Table name: ', TABLE_NAME);
  return { statusCode: 201 };
}