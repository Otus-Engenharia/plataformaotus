/**
 * Use Case: DeleteTodo
 * Remove um ToDo
 */

class DeleteTodo {
  #todoRepository;

  constructor(todoRepository) {
    this.#todoRepository = todoRepository;
  }

  async execute(id) {
    const todo = await this.#todoRepository.findById(id);
    if (!todo) {
      throw new Error('ToDo não encontrado');
    }

    await this.#todoRepository.delete(id);
  }
}

export { DeleteTodo };
