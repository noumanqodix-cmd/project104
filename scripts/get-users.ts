import 'dotenv/config';
import { db } from '../server/db';
import { users } from '../shared/schema';

async function getUsers() {
  try {
    console.log('Getting users from database...');

    const allUsers = await db.select().from(users);

    console.log(`Found ${allUsers.length} users:`);
    console.log(JSON.stringify(allUsers, null, 2));

  } catch (error) {
    console.error('Error getting users:', error);
  } finally {
    process.exit(0);
  }
}

getUsers();