const axios = require("axios");
// 87862
/**
 * Receives and processes a new order webhook from ShipStation.
 */
exports.newOrders = async (req, res, next) => {
  try {
    // Retrieve the URL from the ShipStation webhook.
    const url = req.body.resource_url;

    // Pull the new orders
    const response = await shipstationApiCall(url);

    // If there are new orders, analyze the new orders.
    if (response.data.orders.length >= 1) {
      analyzeOrders(response.data.orders);
    }

    // Reply to the REST API request that new orders have been analyzed.
    res.status(200).json({
      message: `Analyzed ${response.data.orders.length} new order(s).`,
      data: response.data.orders,
    });
  } catch (err) {
    throw new Error(err);
  }
};

/**
 * Analyzs a new order from ShipStation to determine if a split is necessary.
 *
 * @param  {array} newOrders an array of order objects from ShipStation
 */

const skusToTrack = process.env.SKUS_TO_TRACK;
const analyzeOrders = async (newOrders) => {
  // Loop through each new order.
  for (let x = 0; x < newOrders.length; x++) {
    try {
      const order = newOrders[x];
      console.log("🔥🍊🍉 In Analyze", order.items.length);
      if (order.items.length != 1) {
        const sameOrderItems = [];

        const foundItems = [];
        order.items.filter((item) => {
          if (skusToTrack.includes(item.sku)) {
            foundItems.push(item);
          } else {
            sameOrderItems.push(item);
          }
        });

        const orderKey = order.orderKey;
        const orderId = order.orderId;

        let orderUpdateArray = [];
        if (foundItems.length !== 0) {
          orderUpdateArray = [...splitShipstationOrder(order, foundItems)];

          if (sameOrderItems.length != 0) {
            orderUpdateArray.push(createOrderForItems(order, sameOrderItems));
          }
          orderUpdateArray[orderUpdateArray.length - 1].orderKey = orderKey;
          orderUpdateArray[orderUpdateArray.length - 1].orderId = orderId;

          console.log("🔥🍊🍉 ", orderUpdateArray);
          console.log("🔥🍊🍉 ", orderUpdateArray.length);

          await shipstationApiCall(
            "https://ssapi.shipstation.com/orders/createorders",
            "post",
            orderUpdateArray
          );
        }
      }
    } catch (err) {
      console.log("🔥🍊🍉 ERR ", err);
      throw new Error(err);
    }
  }
};

/**
 * Copies the primary order for each new order, adjusting the items on each to correspond
 * to the correct warehouse location.
 *
 * @param  {object} order an order object from the ShipStation API
 * @param {array} warehouses an array of strings containing the warehouse names
 *
 * @return {array} an array of order objects to be updated in ShipStation
 */
const splitShipstationOrder = (order, newItems) => {
  let orderUpdateArray = [];

  delete order.orderKey;
  delete order.orderId;

  // Loop through every warehouse present on the order.
  for (let x = 0; x < newItems.length; x++) {
    try {
      // Create a copy of the original order object.
      let tempOrder = { ...order };
      console.log("🔥🍊🍉 newItems", newItems);
      // Give the new order a number to include the warehouse as a suffix.
      tempOrder.orderNumber = `${tempOrder.orderNumber}-${newItems[x].sku}`;

      // Filter for the order items for this specific warehouse.
      tempOrder.items = [newItems[x]];
      tempOrder.tagIds = [process.env.TAG_ID];
      // If this is not the first (primary) order, set the object to create new order in ShipStation.
      // if (x !== 0) {
      //   delete tempOrder.orderKey;
      //   delete tempOrder.orderId;
      //   tempOrder.amountPaid = 0;
      //   tempOrder.taxAmount = 0;
      //   tempOrder.shippingAmount = 0;
      // }
      console.log("🔥🍊🍉 tempOrder", tempOrder);
      orderUpdateArray.push(tempOrder);
    } catch (err) {
      throw new Error(err);
    }
  }

  return orderUpdateArray;
};

const createOrderForItems = (order, items) => {
  let tempOrder = { ...order };

  delete tempOrder.orderKey;
  delete tempOrder.orderId;

  // Give the new order a number to include the warehouse as a suffix.
  tempOrder.orderNumber = `${tempOrder.orderNumber}-Secondary`;

  // Filter for the order items for this specific warehouse.
  tempOrder.items = items;
  tempOrder.tagIds = [process.env.TAG_ID];

  return tempOrder;
};

/**
 * Performs a ShipStation API Call
 *
 * @param {string} url the full URL to call from ShipStation
 * @param {string} method generally "get" or "post"
 * @param {JSON} body the body of a POST request (if applicable)
 *
 * @return {JSON} the response from the API call
 */
const shipstationApiCall = async (url, method, body) => {
  try {
    const config = {
      method: method || "get",
      url: url,
      headers: {
        // Your API Authorization token goes here.
        Authorization: `Basic ${process.env.SHIPSTATION_KEY}`,
        "Content-Type": "application/json",
      },
    };

    if (body && method.toLowerCase() === "post") {
      config["data"] = JSON.stringify(body);
    }

    const response = await axios(config);
    return response;
  } catch (err) {
    throw new Error(err);
  }
};
