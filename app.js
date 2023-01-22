require("dotenv").config();
const express = require("express");
const shipStationRoutes = require("./routes/shipstation");
const compression = require("compression");

const app = express();
app.use(compression());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/shipstation/", shipStationRoutes);
const port = process.env.PORT;

console.log("🔥🍊🍉 PORT", port);

app.listen(port, () => {
  console.log("🔥🍊🍉 server is listening on port http://localhost:" + port);
});

