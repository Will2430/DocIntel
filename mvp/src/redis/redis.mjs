import { Redis } from "ioredis";
import {createClient} from "redis";
import {RedisPubSubHub} from "./pubsub_hub"

const redis = new Redis({
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

async function subscribeToChannel(channel, handler) {
  const subscriber = createClient({ url: process.env.REDIS_URL });
  await subscriber.connect();
  const hub = new RedisPubSubHub(subscriber);

  await hub.subcribe("questions", ["something"]);

  const delivered = await hub.publish("something", { message: "Hello, Redis Pub/Sub!" });
  console.log("Message delivered to subscribers:", delivered);

  // Listen for messages on the channel
  for (const sub of hub.subcriptions()){
    console.log(sub.name, sub.receivedTotal(), messages);
  }
}


async function main() {
  await redis.set("key", "value");
  const value = await redis.get("key");
  console.log("Value from Redis:", value);
}


subscribeToChannel("questions", (message) => {
  console.log("Received message on channel 'questions':", message);
});
/*main().catch((err) => {
  console.error("Redis error:", err);
  process.exit(1);
}); */

export { redis };