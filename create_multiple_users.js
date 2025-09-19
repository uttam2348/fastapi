// Script to create multiple test users in MongoDB
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

// Connection URL and Database Name
const url = 'mongodb://localhost:27017';
const dbName = 'fastapi_db';

// Hash password function
function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

async function createTestUsers() {
  let client;

  try {
    // Connect to MongoDB
    client = new MongoClient(url);
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    // Define test users
    const testUsers = [
      { username: 'admin1', password: 'password', role: 'admin' },
      { username: 'testuser', password: 'password123', role: 'user' },
      { username: 'manager', password: 'manager123', role: 'manager' },
      { username: 'user1', password: 'user123', role: 'user' },
      { username: 'user2', password: 'user456', role: 'user' }
    ];

    // Add users to database
    for (const user of testUsers) {
      // Check if user already exists
      const existingUser = await usersCollection.findOne({ username: user.username });

      if (existingUser) {
        console.log(`User '${user.username}' already exists`);
      } else {
        // Create a new user
        const result = await usersCollection.insertOne({
          username: user.username,
          hashed_password: hashPassword(user.password),
          role: user.role
        });

        console.log(`Created user '${user.username}' with ID: ${result.insertedId}`);
      }
    }

    // Print all available users
    console.log('\nAvailable users for login:');
    testUsers.forEach(user => {
      console.log(`Username: ${user.username}`);
      console.log(`Password: ${user.password}`);
      console.log(`Role: ${user.role}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run the function
createTestUsers();