import { DynamicModule, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import type { FortAuthOptions } from './interfaces';
import { FortAuthCoreModule } from './fortauth-core.module';

export interface FortAuthAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => FortAuthOptions | Promise<FortAuthOptions>;
  routePrefix?: string;
}

@Module({})
export class FortAuthModule {
  static forRoot(options: FortAuthOptions): DynamicModule {
    const imports: any[] = [FortAuthCoreModule.forRoot(options)];

    if (options.routePrefix) {
      imports.push(
        RouterModule.register([
          { path: options.routePrefix, module: FortAuthCoreModule },
        ]),
      );
    }

    return {
      module: FortAuthModule,
      imports,
      exports: [FortAuthCoreModule],
    };
  }

  static forRootAsync(asyncOptions: FortAuthAsyncOptions): DynamicModule {
    const imports: any[] = [
      ...(asyncOptions.imports || []),
      FortAuthCoreModule.forRootAsync(asyncOptions),
    ];

    if (asyncOptions.routePrefix) {
      imports.push(
        RouterModule.register([
          { path: asyncOptions.routePrefix, module: FortAuthCoreModule },
        ]),
      );
    }

    return {
      module: FortAuthModule,
      imports,
      exports: [FortAuthCoreModule],
    };
  }
}
