import { use } from 'react';
import { StorefrontView } from '@/components/store/storefront-view';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function StoreSlugPage({ params }: PageProps) {
  const { slug } = use(params);
  return <StorefrontView initialSlug={slug} />;
}
