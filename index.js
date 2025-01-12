const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const saltRounds = 10;

const uri = "mongodb+srv://b122310069:RYTvXNLiz40e2X1J@cluster0.fxhm5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.use(express.json());

app.get('/', async (req, res) => {
  res.send('Hello Welcome To PickMeUp!');
});

// Registration route
app.post('/register', async (req, res) => {
  const user = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne(
    { username: { $eq: req.body.username } }
  );

  if (user) {
    res.send('Username already exists');
    return;
  }

  const hash = bcrypt.hashSync(req.body.password, saltRounds);
  await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").insertOne({
    "name": req.body.name,
    "username": req.body.username,
    "password": hash,
    "role": req.body.role // Add role here
  });
  res.send('Register Success: ' + req.body.username);
});

// Admin routes

app.post('/admin/login', async (req, res) => {
  try {
    const user = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne(
      { username: req.body.username, role: 'admin' }
    );

    if (!user) {
      res.send('Username does not exist');
      return;
    }

    const match = bcrypt.compareSync(req.body.password, user.password);

    if (match) {
      const token = jwt.sign({
        userId: user._id,
        role: user.role
      }, 'inipasswordaku', { expiresIn: '1h' });

      res.json({ token: token });
    } else {
      res.send('Login failed');
    }
  } catch (error) {
    res.status(500).send('Error logging in');
  }
});

app.get('/admin/users', async (req, res) => {
   const users = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").find().toArray();
   res.json(users);
});

// Admin route to view all rides
app.get('/admin/rides', async (req, res) => {
  try {
    const rides = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").find().toArray();
    res.json(rides);
  } catch (error) {
    res.status(500).send('Error fetching rides');
  }
});

app.put('/admin/users/:id', async (req, res) => {
   const userId = req.params.id;
   const updatedUser = {
      name: req.body.name,
      username: req.body.username,
      role: req.body.role
   };
   await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").updateOne({ _id: new MongoClient.ObjectID(userId) }, { $set: updatedUser });
   res.send('User updated');
});

app.delete('/admin/users/:id', async (req, res) => {
   const userId = req.params.id;
   await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").deleteOne({ _id: new MongoClient.ObjectID(userId) });
   res.send('User deleted');
});

// Driver routes
app.get('/driver/login', async (req, res) => {
  try {
  const user = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne(
    { username: { $eq: req.body.username }, role: { $eq: 'driver' } }
  );

  if (!user) {
    res.send('Username does not exist');
    return;
  }

  const match = bcrypt.compareSync(req.body.password, user.password);

  if (match) {
    var token = jwt.sign({
      userId: user._id,
      role: user.role
    }, 'inipasswordaku', { expiresIn: 60 });

    res.send({ token : token});
  } else {
    res.send('Login failed');
  }
  } catch (error) {
    res.status(500).send('Error logging in');
  }
});

app.get('/driver/passengers', verifyToken, checkRole('driver'), async (req, res) => {
  const passengers = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").find({ role: 'passenger' }).toArray();
  res.json(passengers);
});

app.put('/driver/profile', checkRole('driver'), async (req, res) => {
  const updatedUser = {
    name: req.body.name,
    username: req.body.username,
    password: bcrypt.hashSync(req.body.password, saltRounds)
  };
  await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").updateOne({ _id: new MongoClient.ObjectID(req.user.userId) }, { $set: updatedUser });
  res.send('Profile updated');
});

app.delete('/driver/account', checkRole('driver'), async (req, res) => {
  await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").deleteOne({ _id: new MongoClient.ObjectID(req.user.userId) });
  res.send('Account deleted');
});

app.get('/driver/pending-rides', checkRole('driver'), async (req, res) => {
  try {
    const pendingRides = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").find({ status: 'pending' }).toArray();
    res.json(pendingRides);
  } catch (error) {
    res.status(500).send('Error fetching pending rides');
  }
});

app.post('/driver/accept-ride/:rideId', verifyToken, checkRole('driver'), async (req, res) => {
  try {
    const ride = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").findOne({ _id: new ObjectId(req.params.rideId) });
    if (ride && ride.status === 'requested') {
      await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").updateOne(
        { _id: new ObjectId(req.params.rideId) },
        { $set: { status: 'accepted', driverId: req.user.userId } }
      );
      res.send('Ride accepted');
    } else {
      res.send('Ride not available for acceptance');
    }
  } catch (error) {
    res.status(500).send('Error accepting ride');
  }
});

// Passenger routes
app.get('/passenger/login', async (req, res) => {
  try {
    const user = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne(
      { username: req.body.username, role: 'passenger' }
    );

    if (!user) {
      res.send('Username does not exist');
      return;
    }

    const match = bcrypt.compareSync(req.body.password, user.password);

    if (match) {
      const token = jwt.sign({
        userId: user._id,
        role: user.role
      }, 'inipasswordaku', { expiresIn: '1h' });

      res.json({ token: token });
    } else {
      res.send('Login failed');
    }
  } catch (error) {
    res.status(500).send('Error logging in');
  }
});

app.post('/passenger/request-ride', verifyToken, checkRole('passenger'), async (req, res) => {
  const ride = {
    passengerId: req.user.userId,
    driverId: null,
    pickupLocation: req.body.pickupLocation,
    dropoffLocation: req.body.dropoffLocation,
    status: 'requested',
  };
  try {
    const result = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").insertOne(ride);
    const rideId = result.insertedId; // This is the generated rideId
    res.json({ message: 'Ride requested', rideId: rideId });
  } catch (error) {
    res.status(500).send('Error requesting ride');
  }
});

app.get('/passenger/driver-info/:rideId', verifyToken, checkRole('passenger'), async (req, res) => {
  try {
    const ride = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").findOne({ _id: new ObjectId(req.params.rideId) });
    if (ride && ride.driverId) {
      const driver = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne({ _id: new ObjectId(ride.driverId) });
      res.json(driver);
    } else {
      res.send('No driver assigned yet');
    }
  } catch (error) {
    res.status(500).send('Error fetching driver info');
  }
});

app.post('/passenger/accept-ride/:rideId',verifyToken, checkRole('passenger'), async (req, res) => {
  try {
    const ride = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").findOne({ _id: new ObjectId(req.params.rideId) });
    if (ride && ride.status === 'requested') {
      await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").updateOne({ _id: new ObjectId(req.params.rideId) }, { $set: { status: 'accepted' } });
      res.send('Ride accepted');
    } else {
      res.send('Ride not available for acceptance');
    }
  } catch (error) {
    res.status(500).send('Error accepting ride');
  }
});

app.delete('/passenger/account', verifyToken, checkRole('passenger'), async (req, res) => {
  try {
    await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").deleteOne({ _id: new ObjectId(req.user.userId) });
    res.send('Account deleted');
  } catch (error) {
    res.status(500).send('Error deleting account');
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, "inipasswordaku", (err, decoded) => {
    if (err) return res.sendStatus(403);

    req.user = decoded;

    next();
  });
}

function checkRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.sendStatus(403);
    }
    next();
  };
}