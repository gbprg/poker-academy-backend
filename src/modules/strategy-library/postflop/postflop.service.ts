import { Injectable, NotFoundException } from '@nestjs/common';
import { PostflopRepository } from './postflop.repository.js';

@Injectable()
export class PostflopService {
  constructor(private readonly repo: PostflopRepository) {}

  async listTrees(filters: { format: string; valuation: string; street: string; tableSize: number }) {
    const trees = await this.repo.listPublishedTrees(filters);
    return {
      available: trees.length > 0,
      items: trees.map((tree) => ({
        spot: tree.spot,
        version: tree.version,
        nodeCount: tree.nodeCount,
      })),
    };
  }

  async getNode(nodeId: string) {
    const node = await this.repo.getPublishedNode(nodeId);
    if (!node) {
      throw new NotFoundException('Nó não encontrado ou não publicado');
    }
    return {
      nodeKey: node.nodeKey,
      strategyVersionId: node.strategyVersionId,
      spot: node.version.spot,
      actions: node.actions,
    };
  }
}
