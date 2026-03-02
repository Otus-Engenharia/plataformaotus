/**
 * Entidade: TimeSavingsEvent
 * Aggregate Root do domínio de Economia de Horas
 *
 * Representa um evento individual de economia de tempo por uso de automação.
 * Cada vez que um usuário utiliza uma automação da plataforma, um evento é criado.
 */

import { AutomationType } from '../value-objects/AutomationType.js';

class TimeSavingsEvent {
  #id;
  #catalogId;
  #userEmail;
  #userName;
  #minutesSaved;
  #resourceType;
  #resourceId;
  #resourceName;
  #details;
  #createdAt;

  constructor({
    id = null,
    catalogId,
    userEmail,
    userName = null,
    minutesSaved,
    resourceType = null,
    resourceId = null,
    resourceName = null,
    details = null,
    createdAt = null,
  }) {
    if (!catalogId) {
      throw new Error('O tipo de automação (catalogId) é obrigatório');
    }

    if (!userEmail) {
      throw new Error('O email do usuário é obrigatório');
    }

    if (minutesSaved == null || minutesSaved <= 0) {
      throw new Error('O tempo economizado deve ser maior que zero');
    }

    // Valida que o catalogId é um tipo de automação conhecido
    if (AutomationType.isValid(catalogId)) {
      this.#catalogId = new AutomationType(catalogId);
    } else {
      // Permite IDs de catálogo não conhecidos no VO (extensibilidade)
      this.#catalogId = catalogId;
    }

    this.#id = id;
    this.#userEmail = userEmail;
    this.#userName = userName;
    this.#minutesSaved = Number(minutesSaved);
    this.#resourceType = resourceType;
    this.#resourceId = resourceId;
    this.#resourceName = resourceName;
    this.#details = details;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get catalogId() {
    return this.#catalogId instanceof AutomationType
      ? this.#catalogId.value
      : this.#catalogId;
  }
  get catalogLabel() {
    return this.#catalogId instanceof AutomationType
      ? this.#catalogId.label
      : this.#catalogId;
  }
  get userEmail() { return this.#userEmail; }
  get userName() { return this.#userName; }
  get minutesSaved() { return this.#minutesSaved; }
  get hoursSaved() { return Math.round(this.#minutesSaved / 60 * 100) / 100; }
  get resourceType() { return this.#resourceType; }
  get resourceId() { return this.#resourceId; }
  get resourceName() { return this.#resourceName; }
  get details() { return this.#details; }
  get createdAt() { return this.#createdAt; }

  toPersistence() {
    return {
      id: this.#id,
      catalog_id: this.catalogId,
      user_email: this.#userEmail,
      user_name: this.#userName,
      minutes_saved: this.#minutesSaved,
      resource_type: this.#resourceType,
      resource_id: this.#resourceId,
      resource_name: this.#resourceName,
      details: this.#details,
      created_at: this.#createdAt.toISOString(),
    };
  }

  toResponse() {
    return {
      id: this.#id,
      catalog_id: this.catalogId,
      catalog_label: this.catalogLabel,
      user_email: this.#userEmail,
      user_name: this.#userName,
      minutes_saved: this.#minutesSaved,
      hours_saved: this.hoursSaved,
      resource_type: this.#resourceType,
      resource_id: this.#resourceId,
      resource_name: this.#resourceName,
      details: this.#details,
      created_at: this.#createdAt.toISOString(),
    };
  }

  static fromPersistence(data) {
    return new TimeSavingsEvent({
      id: data.id,
      catalogId: data.catalog_id,
      userEmail: data.user_email,
      userName: data.user_name,
      minutesSaved: data.minutes_saved,
      resourceType: data.resource_type,
      resourceId: data.resource_id,
      resourceName: data.resource_name,
      details: data.details,
      createdAt: data.created_at,
    });
  }

  static create({ catalogId, userEmail, userName, minutesSaved, resourceType, resourceId, resourceName, details }) {
    return new TimeSavingsEvent({
      catalogId,
      userEmail,
      userName,
      minutesSaved,
      resourceType,
      resourceId,
      resourceName,
      details,
    });
  }
}

export { TimeSavingsEvent };
