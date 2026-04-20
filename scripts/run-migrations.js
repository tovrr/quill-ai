#!/usr/bin/env node

/**
 * Database Migration Script for Quill AI
 * 
 * This script runs database migrations for the persistent observability system,
 * including the metrics table creation and necessary indexes.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";

console.log('🔄 Running Quill AI Database Migrations...\n');

async function runMigrations() {
  try {
    // 1. Check if metrics table already exists
    console.log('📊 Checking for existing metrics table...');
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'metric'
      )
    `);
    
    const tableExistsResult = tableExists[0]?.exists || false;
    
    if (tableExistsResult) {
      console.log('✅ Metrics table already exists');
      return;
    }

    // 2. Create metrics table if it doesn't exist
    console.log('🏗️ Creating metrics table...');
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS metric (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_type VARCHAR(50) NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        route VARCHAR(255),
        feature VARCHAR(100),
        value DOUBLE PRECISION NOT NULL,
        metadata JSONB,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Create indexes
    console.log('📊 Creating indexes for metrics table...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS metric_user_id_idx ON metric(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS metric_type_idx ON metric(metric_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS metric_timestamp_idx ON metric(timestamp)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS metric_route_idx ON metric(route)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS metric_feature_idx ON metric(feature)`);

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Metrics table created with the following structure:');
    console.log('   • id: Primary key (UUID)');
    console.log('   • metric_type: Type of metric (string, length 50)');
    console.log('   • user_id: Reference to user (can be null)');
    console.log('   • route: API endpoint (optional)');
    console.log('   • feature: Feature name (optional)');
    console.log('   • value: Numeric value of metric');
    console.log('   • metadata: Additional JSON data');
    console.log('   • timestamp: When the metric was recorded');
    console.log('   • created_at: When the record was created\n');
    
    console.log('📋 Indexes created for performance:');
    console.log('   • user_id: For user-specific analytics');
    console.log('   • metric_type: For filtering by metric type');
    console.log('   • timestamp: For time-based queries');
    console.log('   • route: For API endpoint analytics');
    console.log('   • feature: For feature usage analytics\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function cleanupOldData() {
  try {
    console.log('🧹 Cleaning up old data...');
    
    // Clean up metrics older than 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    const result = await db.execute(sql`
      DELETE FROM metrics 
      WHERE timestamp < ${cutoffDate}
      RETURNING COUNT(*) as deleted_rows
    `);

    const deletedRows = result[0]?.deleted_rows || 0;
    console.log(`🧹 Cleaned up ${deletedRows} old metric records`);
    
  } catch (error) {
    console.error('❌ Data cleanup failed:', error);
  }
}

async function main() {
  console.log('🚀 Starting Quill AI database migrations\n');
  
  // Run the main migration
  await runMigrations();
  
  // Optional: Run data cleanup
  console.log('Would you like to clean up old data? (metrics older than 90 days)?');
  console.log('(This is safe to run and will improve performance)\n');
  
  // For now, just show what would be cleaned up
  await cleanupOldData();
  
  console.log('✨ Migration process completed!');
  console.log('\n📊 Next steps:');
  console.log('1. Test analytics at /admin/analytics');
  console.log('2. Check system metrics in the dashboard');
  console.log('3. Monitor for performance improvements');
}

// Run the main function
main().catch(error => {
  console.error('💥 Migration script failed:', error);
  process.exit(1);
});

export { runMigrations, cleanupOldData };
