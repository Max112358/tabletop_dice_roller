export class NodeRegistry {
  constructor() {
    this.types = new Map();
  }

  register(def) {
    if (!def?.type) throw new Error("Node definition missing type");
    if (this.types.has(def.type)) {
      throw new Error(`Node type already registered: ${def.type}`);
    }
    this.types.set(def.type, def);
  }

  get(type) {
    return this.types.get(type) ?? null;
  }

  has(type) {
    return this.types.has(type);
  }

  all() {
    return [...this.types.values()];
  }

  modifierTypes() {
    return this.all().filter((d) => d.category === "modifier");
  }
}

export const registry = new NodeRegistry();
