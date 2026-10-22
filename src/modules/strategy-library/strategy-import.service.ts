import { BadRequestException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { StrategyCatalogImporter, type PersistResult } from './strategy-catalog.importer.js';
import { estimateBundleBytes, MAX_BUNDLE_BYTES, type ImportReport } from './importer.js';
import { StrategySourceRepository } from './strategy-source.repository.js';

export interface PreviewResult {
  sourceId: string;
  persisted: false;
  report: ImportReport;
}

@Injectable()
export class StrategyImportService {
  constructor(
    @Inject(StrategyCatalogImporter) private readonly importer: StrategyCatalogImporter,
    @Inject(StrategySourceRepository) private readonly sources: StrategySourceRepository,
  ) {}

  private async requireSource(sourceId: string) {
    const source = await this.sources.findById(sourceId);
    if (!source) {
      throw new NotFoundException(`Source ${sourceId} not found`);
    }
    return source;
  }

  private assertWithinSizeLimit(bundle: string): void {
    if (estimateBundleBytes(bundle) > MAX_BUNDLE_BYTES) {
      throw new PayloadTooLargeException(
        `Bundle exceeds the maximum size of ${MAX_BUNDLE_BYTES} bytes`,
      );
    }
  }

  /**
   * Validates a bundle without persisting or publishing anything.
   * The report is fully actionable (typed issues) and never mutates the catalog.
   */
  async preview(sourceId: string, bundle: string): Promise<PreviewResult> {
    await this.requireSource(sourceId);
    this.assertWithinSizeLimit(bundle);
    return { sourceId, persisted: false, report: this.importer.dryRun(bundle) };
  }

  /**
   * Validates and persists a bundle as DRAFT content. Persisting never publishes:
   * the lifecycle transition remains a separate, explicit step.
   */
  async commit(sourceId: string, bundle: string): Promise<PersistResult & { persisted: true }> {
    await this.requireSource(sourceId);
    this.assertWithinSizeLimit(bundle);
    const report = await this.importer.persist(bundle, { sourceId });
    if (!report.ok) {
      throw new BadRequestException({
        message: 'Bundle failed validation and was not persisted',
        report,
      });
    }
    return { ...report, persisted: true };
  }
}
