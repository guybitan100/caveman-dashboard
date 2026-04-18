import { faker } from "@faker-js/faker";
import { CreateEntityRequest } from "../types/cart";

/**
 * Generates mock entity data using Faker.js
 * Used when creating new entities from story forms
 */
export function generateMockEntity(): CreateEntityRequest {
  const isMale = faker.datatype.boolean();
  const sex = isMale ? "male" : "female";

  return {
    first_name: faker.person.firstName(sex),
    last_name: faker.person.lastName(sex),
    phone: faker.phone.number({ style: "international" }),
    email: faker.internet.email(),
    is_male: isMale,
  };
}
