export class EventUtil {
  private static parseBody(event:any):any {
    console.log("Event: ", event);
    let body = JSON.parse(event.body);
    if (!body) {
      body = {};
    }

    console.log("Request body: ", body);
    
    return body;
  }
  public static parseEvent(event:any):{customerID: string, eventBody: any} {
    const body = EventUtil.parseBody(event);
    const customerID = event.requestContext.authorizer.principalId;
    
    console.log("customerID: ", customerID);
    return {
      customerID: customerID,
      eventBody: body
    }
  }
}