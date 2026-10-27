import { NotFoundPage, generatePageMetadata } from '@payloadcms/next/views';
import config from '@payload-config';
import { importMap } from '../importMap';
import React from 'react';

export const dynamic = 'force-dynamic';

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const generateMetadata = ({ params, searchParams }: Args) =>
  generatePageMetadata({ config, params, searchParams });

const NotFound = ({ params, searchParams }: Args) =>
  NotFoundPage({ config, importMap, params, searchParams });

export default NotFound;
