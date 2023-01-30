const express = require("express");
const app = express();

const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
app.use(express.json());

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running ..");
    });
  } catch (e) {
    console.log(`Db error ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();
//API 1 login

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", authenticateToken, async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `select * from user where username=${username};`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    //user not registered
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordMatches = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatches === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "secret_token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
const requiredOutput = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `select * from state;`;
  const statesArr = await db.all(getStatesQuery);
  response.send(statesArr.map((each) => requiredOutput(each)));
});

//API3 get state-8
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `select * from state where state_id =${stateId}`;
  const stateObj = await db.get(getStateQuery);
  response.send(stateObj.map((each) => requiredOutput(each)));
});
//API 4 CREATE DISTRICT TABLE
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `insert into district 
  (district_name,
    state_id,
    cases,
    cured,
    active,
    deaths)
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;

  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});
//API 5 get district
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `select * from district where district_id=${districtId};`;
    const districtObj = await db.get(getDistrictQuery);
    response.send({
      districtId: districtId,
      districtName: districtObj.district_name,
      state_id: districtObj.stateId,
      cases: districtObj.cases,
      cured: districtObj.cured,
      active: districtObj.active,
      deaths: districtObj.deaths,
    });
  }
);
//API 6 delete

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `delete from district where district_id=${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);
//update district
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `update district 
    set 
        district_name='${districtName}',
        state_id=${stateId},
        cases =${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
    where 
        district_id=${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);
//API 8 GET DETAILS STATS
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getSumDetails = `
    select 
        SUM(cases) as totalCases,
        SUM(cured) as totalCured,
        SUM(active) as totalActive,
        SUM(deaths) as totalDeaths
    from 
        district
    where 
        state_id=${stateId};`;
    const stats = await db.get(getSumDetails);
    response.send(stats);
  }
);
module.exports = app;
