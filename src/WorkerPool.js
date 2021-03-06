class WorkerPool {
  constructor () {
    this.workers = new Map()
  }

  addWorker (id, worker, metadata = {}) {
    return this.workers.set(id, {
      worker,
      metadata
    })
  }

  hasWorker (id) {
    return this.workers.has(id)
  }

  getWorker (id) {
    return this.workers.get(id)
  }

  removeWorker (id) {
    return this.workers.delete(id)
  }
}

module.exports = { WorkerPool }
