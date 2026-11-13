/** Browser stand-in so Storybook can import modules that reference `node:crypto`. */

type Hasher = {
  update(data: string): Hasher;
  digest(encoding?: string): string;
};

export function createHash(_algorithm: string): Hasher {
  let data = "";
  const hasher: Hasher = {
    update(chunk: string) {
      data += chunk;
      return hasher;
    },
    digest() {
      return data;
    },
  };
  return hasher;
}

export function randomUUID(): string {
  return "00000000-0000-4000-8000-000000000001";
}
