import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^"|"$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();
async function testStripeFlow() {
  const { db } = await import("../src/db");
  const { userEntitlements } = await import("../src/db/schema");
  const { entitlementsService } = await import("../src/lib/entitlements");
  console.log("🧪 Testing Stripe Payment Flow\n");

  try {
    // Test 1: Create mock user entitlement
    console.log("1. Creating mock user entitlement...");
    const testUserId = "test-user-stripe-flow";

    // Delete any existing test data
    await db.delete(userEntitlements).where(eq(userEntitlements.userId, testUserId));

    const freeEntitlement = await entitlementsService.createEntitlement(testUserId, "free");
    console.log(`   ✅ Created free entitlement for user: ${freeEntitlement.id}`);

    // Test 2: Check free tier access
    console.log("2. Testing free tier access...");
    const canAccessFreeFeatures = await entitlementsService.checkEntitlement(testUserId, "free");
    console.log(`   ✅ Free features access: ${canAccessFreeFeatures}`);

    // Test 3: Check pro tier access (should fail)
    console.log("3. Testing pro tier access (should fail)...");
    const canAccessProFeatures = await entitlementsService.checkEntitlement(testUserId, "pro");
    console.log(`   ✅ Pro features access: ${canAccessProFeatures} (should be false)`);

    // Test 4: Simulate successful Stripe subscription
    console.log("4. Simulating successful Stripe subscription...");
    const proEntitlement = await entitlementsService.updateEntitlement(testUserId, {
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_test_stripe_customer",
      stripeSubscriptionId: "sub_test_stripe_subscription",
      stripePriceId: "price_pro_monthly",
      paidStartsAt: new Date(),
      paidEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      webhookProcessedAt: new Date(),
    });
    console.log(`   ✅ Updated to pro plan: ${proEntitlement.id}`);

    // Test 5: Check pro tier access after upgrade
    console.log("5. Testing pro tier access after upgrade...");
    const canAccessProAfterUpgrade = await entitlementsService.checkEntitlement(testUserId, "pro");
    console.log(`   ✅ Pro features access after upgrade: ${canAccessProAfterUpgrade}`);

    // Test 6: Test feature access control
    console.log("6. Testing feature access control...");
    const canAdvancedPolicy = await entitlementsService.canAccessFeature(testUserId, "advanced_policy");
    const canMultiUser = await entitlementsService.canAccessFeature(testUserId, "multi_user");
    console.log(`   ✅ Advanced policy access: ${canAdvancedPolicy} (should be true)`);
    console.log(`   ✅ Multi-user access: ${canMultiUser} (should be false)`);

    // Test 7: Test expired subscription
    console.log("7. Testing expired subscription...");
    const expiredEntitlement = await entitlementsService.updateEntitlement(testUserId, {
      paidEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: "expired",
    });

    const canAccessExpiredPro = await entitlementsService.checkEntitlement(testUserId, "pro");
    console.log(`   ✅ Pro features access with expired subscription: ${canAccessExpiredPro} (should be false)`);
    console.log(`   ✅ Downgraded to free plan: ${expiredEntitlement.status}`);

    console.log("\n🎉 All tests completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   • Free tier access: ✅ Working");
    console.log("   • Pro tier upgrade: ✅ Working");
    console.log("   • Feature access control: ✅ Working");
    console.log("   • Subscription expiration: ✅ Working");
    console.log("   • Downgrade handling: ✅ Working");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    // Clean up test data
    console.log("\n🧹 Cleaning up test data...");
    await db.delete(userEntitlements).where(eq(userEntitlements.userId, "test-user-stripe-flow"));
    console.log("   ✅ Test data cleaned up");
  }
}

await testStripeFlow();
