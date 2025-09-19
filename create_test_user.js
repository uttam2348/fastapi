// Simple script to create a test user in MongoDB
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

async function createTestUser() {
  let client;

  try {
    // Connect to MongoDB
    client = new MongoClient(url);
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ username: 'admin1' });

    if (existingUser) {
      console.log('User admin1 already exists');
    } else {
      // Create a new user
      const result = await usersCollection.insertOne({
        username: 'admin1',
        hashed_password: hashPassword('password'),
        role: 'admin'
      });

      console.log(`Created user admin1 with ID: ${result.insertedId}`);
    }

    console.log('You can use these credentials to log in:');
    console.log('Username: admin1');
    console.log('Password: password');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

createTestUser();