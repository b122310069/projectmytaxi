const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
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
    "role": req.body.role // Add role 
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

app.get('/admin/users', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const users = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").find({ role: { $in: ['driver', 'passenger'] } }).toArray();
    res.json(users);
  } catch (error) {
    res.status(500).send('Error fetching users');
  }
});

// Admin route to view all rides
app.get('/admin/rides', verifyToken, checkRole('admin') , async (req, res) => {
  try {
    const rides = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").find().toArray();
    res.json(rides);
  } catch (error) {
    res.status(500).send('Error fetching rides');
  }
});

app.put('/admin/users', verifyToken, checkRole('admin'), async (req, res) => {
  const { username, updatedUser } = req.body;

  if (!username || !updatedUser) {
    return res.status(400).send('Username and updated user details are required');
  }

  try {
    const result = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").updateOne(
      { username: username },
      { $set: updatedUser }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send('User not found');
    }

    res.send('User updated');
  } catch (error) {
    res.status(500).send('Error updating user');
  }
});

app.delete('/admin/users/:id', verifyToken, checkRole('admin'), async (req, res) => {
  const userId = req.params.id;

  try {
    const result = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").deleteOne({ _id: new ObjectId(userId) });

    if (result.deletedCount === 1) {
      res.send('User deleted successfully');
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    res.status(500).send('Error deleting user');
  }
});

// Driver routes
// Register a driver and their car
app.post('/driver/register/car' , async (req, res) => {
  try {
    const existingUser = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne(
      { username: req.body.username }
    );

    if (existingUser) {
      return res.status(400).send('Driver username already exists');
    }

    const hash = bcrypt.hashSync(req.body.password, saltRounds);
    const newDriver = {
      name: req.body.name,
      username: req.body.username,
      password: hash,
      role: 'driver',
    };

    const result = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").insertOne(newDriver);

    const newCar = {
      driverId: result.insertedId,
      licensePlate: req.body.car.licensePlate,
      color: req.body.car.color,
      model: req.body.car.model,
    };

    await client.db("ProjectAssignmentTaxiDatabase").collection("Cars").insertOne(newCar);

    res.status(201).send('Driver and car registered successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error registering driver and car');
  }
});

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
    }, 'inipasswordaku', { expiresIn: '1h' });

    res.send({ token : token, driverId: user._id});
  } else {
    res.send('Login failed');
  }
  } catch (error) {
    res.status(500).send('Error logging in');
  }
});

app.get('/driver/passengers', verifyToken, checkRole('driver'), async (req, res) => {
  try {
    const passengers = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").find({ role: 'passenger' },{ projection: { name: 1 } }).toArray();
    res.json(passengers);
  } catch (error) {
    res.status(500).send('Error fetching passengers');
  }
});

app.put('/driver/profile', verifyToken, checkRole('driver'), async (req, res) => {
  const driverId = req.user.userId;
  const updatedUser = {
    username: req.body.username,
    password: bcrypt.hashSync(req.body.password, saltRounds)
  };

  const user = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne({ _id: new ObjectId(driverId) });

  if (!user) {
    return res.status(404).send('User not found');
  }

  await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").updateOne({ _id: new ObjectId(driverId) }, { $set: updatedUser });
  res.send('Profile updated');
});

app.delete('/driver/account', verifyToken, checkRole('driver'), async (req, res) => {
  try {
    const { username, password } = req.body;

    // Step 1: Retrieve the user document by username
    const user = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne({ username });

    if (!user) {
      console.log('Account not found for username: ' + username);
      return res.status(404).json({ message: 'Account not found.' });
    }

    // Step 2: Verify the provided password matches the stored password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Invalid password for username: ' + username);
      return res.status(401).json({ message: 'Invalid password.' });
    }

    // Step 3: Proceed to delete the user account
    const result = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").deleteOne({ username });

    if (result.deletedCount === 1) {
      console.log('Account : ' + username + ' deleted');
      res.status(200).json({ message: 'Account deleted successfully.' });
    } else {
      console.log('Failed to delete account for username: ' + username);
      res.status(500).json({ message: 'Failed to delete account.' });
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/driver/accept-ride', verifyToken, checkRole('driver'), async (req, res) => {
  try {
    const { rideId } = req.body; // Get rideId from the request body
    const driverId = req.user.userId; // Driver's userId from the token

    // Validate if rideId is provided
    if (!rideId) {
      return res.status(400).send('Ride ID is required');
    }

    // Check if the ride exists and is in "requested" status with no driver assigned
    const ride = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").findOne({ _id: new ObjectId(rideId), status: 'requested', driverId: null });

    if (ride) {
      // Update the ride to "accepted" and assign the driver's ID
      await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").updateOne({ _id: new ObjectId(rideId) }, {$set: { status: 'accepted',driverId: new ObjectId(driverId) }});

      res.send('Ride accepted');
    } else {
      res.send('Ride not available for acceptance or already taken');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
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

app.post('/passenger/ride-details', verifyToken, checkRole('passenger'), async (req, res) => {
  try {
    const { rideId } = req.body;

    // Fetch the ride details for the given rideId and passengerId
    const ride = await client.db("ProjectAssignmentTaxiDatabase").collection("Rides").findOne({ _id: new ObjectId(rideId) });

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found or not assigned to this passenger' });
    }

    // Fetch the driver's car details using the driverId from the ride
    if (ride.driverId) {
      const car = await client.db("ProjectAssignmentTaxiDatabase").collection("Cars").findOne({ driverId: new ObjectId(ride.driverId) });
          // Check if car details were found
    if (!car) {
      return res.status(404).json({ error: 'Car details not found for the assigned driver' });
    }
    else res.status(200).json({
      rideId: ride._id,
      status: ride.status,
      driverId: ride.driverId,
      car: {
        licensePlate: car.licensePlate,
        color: car.color,
        model: car.model
      }
    });
  }
    // Respond with ride details including the car informati
  } catch (error) {
    console.error('Error fetching ride details:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/passenger/account', verifyToken, checkRole('passenger'), async (req, res) => {
  try {
    const { username, password } = req.body;

    // Step 1: Retrieve the user document by username
    const user = await client
      .db("ProjectAssignmentTaxiDatabase").collection("Coding").findOne({ username });

    if (!user) {
      console.log('Account not found for username: ' + username);
      return res.status(404).json({ message: 'Account not found.' });
    }

    // Step 2: Verify the provided password matches the stored password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Invalid password for username: ' + username);
      return res.status(401).json({ message: 'Invalid password.' });
    }

    // Step 3: Proceed to delete the user account
    const result = await client.db("ProjectAssignmentTaxiDatabase").collection("Coding").deleteOne({ username });

    if (result.deletedCount === 1) {
      console.log('Account : ' + username + ' deleted');
      res.status(200).json({ message: 'Account deleted successfully.' });
    } else {
      console.log('Failed to delete account for username: ' + username);
      res.status(500).json({ message: 'Failed to delete account.' });
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
