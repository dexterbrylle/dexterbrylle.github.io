import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site, notes } from '../data/site.json';

export async function GET() {
  const posts = (await getCollection('blog')).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return rss({
    title: `${site.name}'s notes`,
    description: notes.description,
    site: `https://${site.domain}`,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      link: `/notes/${post.id.replace(/\.md$/, '')}/`,
    })),
    customData: '<language>en</language>',
  });
}
