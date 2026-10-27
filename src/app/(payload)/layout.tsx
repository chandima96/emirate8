import React from 'react';
import '@payloadcms/next/css';
import type { ServerFunctionClientArgs } from 'payload';
import config from '@payload-config';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import { importMap } from './admin/importMap';

export const dynamic = 'force-dynamic';

// The Payload admin UI manages its own <html> and <body> — do NOT nest inside the site layout.
export default function PayloadLayout({ children }: { children: React.ReactNode }) {
  async function serverFunction(args: ServerFunctionClientArgs) {
    'use server';

    return handleServerFunctions({ ...args, config, importMap });
  }

  return RootLayout({
    children,
    config,
    importMap,
    serverFunction,
  });
}
