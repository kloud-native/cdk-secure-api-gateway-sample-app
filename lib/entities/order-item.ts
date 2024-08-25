export class OrderItem {
  public productID:String;
  public productTitle:String;
  public productPrice:Number;
  public quantity:Number;

  public constructor(productID:String, productTitle:String, 
    productPrice:Number, quantity:Number) {
      this.productID = productID;
      this.productTitle = productTitle;
      this.productPrice = productPrice;
      this.quantity = quantity;
  }
}