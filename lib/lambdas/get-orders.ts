const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async(event: any = {}): Promise<any> => {
  console.log('In get order. Table name: ', TABLE_NAME);
  return { statusCode: 201 };
}