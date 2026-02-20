/**
 * Script to set user role
 * Usage: 
 *   ts-node src/scripts/set-user-role.ts <userId> <role>
 *   ts-node src/scripts/set-user-role.ts <email> <role> --by-email
 * 
 * Example:
 *   ts-node src/scripts/set-user-role.ts user@example.com super_admin --by-email
 *   ts-node src/scripts/set-user-role.ts 123e4567-e89b-12d3-a456-426614174000 super_admin
 */

import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

async function setUserRole(userIdOrEmail: string, role: 'user' | 'super_admin', byEmail: boolean = false) {
  try {
    let userId: string;

    if (byEmail) {
      // Find user by email
      const { data: profile, error: findError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', userIdOrEmail)
        .single();

      if (findError || !profile) {
        logger.error(`User not found with email: ${userIdOrEmail}`);
        process.exit(1);
      }

      userId = profile.id;
    } else {
      userId = userIdOrEmail;
    }

    // Validate role
    if (!['user', 'super_admin'].includes(role)) {
      logger.error(`Invalid role: ${role}. Must be 'user' or 'super_admin'`);
      process.exit(1);
    }

    // Update user role
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user role:', error);
      process.exit(1);
    }

    logger.info(`Successfully set user ${userId} role to ${role}`);
    console.log(`✅ User role updated:`);
    console.log(`   User ID: ${data.id}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Role: ${data.role}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to set user role:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage:');
  console.log('  ts-node set-user-role.ts <userId> <role>');
  console.log('  ts-node set-user-role.ts <email> <role> --by-email');
  console.log('');
  console.log('Examples:');
  console.log('  ts-node set-user-role.ts user@example.com super_admin --by-email');
  console.log('  ts-node set-user-role.ts 123e4567-e89b-12d3-a456-426614174000 super_admin');
  console.log('');
  console.log('Roles: user, super_admin');
  process.exit(1);
}

const userIdOrEmail = args[0];
const role = args[1] as 'user' | 'super_admin';
const byEmail = args.includes('--by-email');

setUserRole(userIdOrEmail, role, byEmail);
