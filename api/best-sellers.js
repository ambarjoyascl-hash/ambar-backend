const STORE = "ambar-8632.myshopify.com";
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;

const QUERY = `{
  products(first: 12, sortKey: BEST_SELLING) {
    edges {
      node {
        id
        title
        handle
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        compareAtPriceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 1) {
          edges {
            node {
              id
              availableForSale
            }
          }
        }
      }
    }
  }
}`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  if (!STOREFRONT_TOKEN) {
    return res.status(500).json({ ok: false, error: "SHOPIFY_STOREFRONT_TOKEN no configurado" });
  }

  try {
    const response = await fetch(
      `https://${STORE}/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query: QUERY }),
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify respondió con ${response.status}`);
    }

    const { data, errors } = await response.json();

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    const products = data.products.edges.map(({ node }) => {
      const price = node.priceRange.minVariantPrice;
      const compareAt = node.compareAtPriceRange?.minVariantPrice;
      const variant = node.variants.edges[0]?.node;

      return {
        id: node.id,
        title: node.title,
        handle: node.handle,
        url: `https://www.ambarjoyas.cl/products/${node.handle}`,
        price: parseFloat(price.amount),
        currency: price.currencyCode,
        compareAtPrice: compareAt ? parseFloat(compareAt.amount) : null,
        image: node.featuredImage?.url ?? null,
        imageAlt: node.featuredImage?.altText ?? node.title,
        available: variant?.availableForSale ?? false,
        variantId: variant?.id ?? null,
      };
    });

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.json({ ok: true, products });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
