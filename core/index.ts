import { run } from "./app/langchain-serve/src/index";
import { logger } from "./app/langchain-serve/src/utils/logger";

run().catch((err) => {
  logger.error(err, "langchain-serve failed to start");
  process.exitCode = 1;
});
