/**
 * Sincroniza el catálogo público de Valen Makeup desde Cuanto.app.
 * Si Cuanto cambia su estructura interna, este archivo podría requerir ajustes.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const PRODUCTOS_URL = 'https://cuanto.app/valenmakeup/products';
const PRECIOS_URL = 'https://cuanto.app/ecommerce/valenmakeup/prices';
const SALIDA = path.join(process.cwd(), 'valenmakeupWeb', 'wwwroot', 'datos', 'productos.json');

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'ValenMakeupCatalogSync/1.0' } });
  if (!response.ok) throw new Error(`Error ${response.status} consultando ${url}`);
  return response.json();
}

const numero = valor => typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
const colones = valor => numero(valor) === null ? null : valor / 100;

function imagenes(producto) {
  if (!Array.isArray(producto.images)) return producto.image_url ? [producto.image_url] : [];
  return producto.images.map(i => typeof i === 'string' ? i : (i?.url || i?.image_url)).filter(Boolean);
}

function categoriasAnteriores(catalogo) {
  const mapa = new Map();
  (catalogo?.categorias || []).forEach(c => { if (c.uuid && c.nombre) mapa.set(c.uuid, c.nombre); });
  (catalogo?.productos || []).flatMap(p => p.categorias || []).forEach(c => { if (c.uuid && c.nombre) mapa.set(c.uuid, c.nombre); });
  return mapa;
}

async function main() {
  let anterior = {};
  try { anterior = JSON.parse(await fs.readFile(SALIDA, 'utf8')); } catch { /* primer uso */ }

  const [respuestaProductos, respuestaPrecios] = await Promise.all([getJson(PRODUCTOS_URL), getJson(PRECIOS_URL)]);
  const origenProductos = Array.isArray(respuestaProductos) ? respuestaProductos : (respuestaProductos.products || []);
  const origenPrecios = Array.isArray(respuestaPrecios) ? respuestaPrecios : (respuestaPrecios.prices || []);
  if (!origenProductos.length) throw new Error('Cuanto no devolvió productos; se conserva el catálogo anterior.');

  const precioPorProducto = new Map(origenPrecios.map(p => [p.product_uuid, p]));
  const nombresCategorias = categoriasAnteriores(anterior);
  (respuestaProductos.categories || []).forEach(c => { if (c.uuid && (c.name || c.nombre)) nombresCategorias.set(c.uuid, c.name || c.nombre); });

  const productos = origenProductos.map(p => {
    const precio = precioPorProducto.get(p.uuid) || {};
    const cantidad = numero(p.inventory?.quantity);
    const controlado = p.inventory?.enabled === true;
    const disponible = p.published !== false && precio.sold_out !== true && !(controlado && cantidad !== null && cantidad <= 0);
    return {
      id: p.id,
      uuid: p.uuid,
      short_uuid: p.short_uuid || null,
      nombre: p.name || '',
      descripcion_corta: p.short_description || '',
      descripcion: p.description || '',
      precio: colones(precio.amount ?? p.price),
      precio_anterior: colones(precio.amount_not_discounted ?? p.price_not_discounted),
      moneda: String(p.currency || 'crc').toUpperCase(),
      publicado: p.published !== false,
      imagenes: imagenes(p),
      opciones: p.variant_options || {},
      es_variante: Boolean(p.product_group_uuid),
      grupo_uuid: p.product_group_uuid || null,
      categorias: (p.categories || []).map(c => {
        const uuid = typeof c === 'string' ? c : c.uuid;
        const nombre = typeof c === 'object' ? (c.name || c.nombre || nombresCategorias.get(uuid) || '') : (nombresCategorias.get(uuid) || '');
        return { uuid, nombre };
      }).filter(c => c.uuid),
      inventario: { controlado, cantidad, disponible },
      actualizado: p.updated_at || null,
      enlace_cuanto: p.short_uuid ? `https://cuanto.app/valenmakeup/w/${p.short_uuid}` : null
    };
  });

  const principales = productos.filter(p => !p.es_variante);
  const variantes = productos.filter(p => p.es_variante);
  const categorias = [...nombresCategorias].map(([uuid, nombre]) => ({ uuid, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const grupos = new Map();
  variantes.forEach(v => { if (v.grupo_uuid) grupos.set(v.grupo_uuid, [...(grupos.get(v.grupo_uuid) || []), v.uuid]); });

  const catalogo = {
    tienda: { nombre: 'Valen Makeup', origen: 'https://cuanto.app/valenmakeup', moneda: 'CRC' },
    resumen: { total_registros: productos.length, productos_principales_o_individuales: principales.length, variantes: variantes.length, categorias: categorias.length, agotados: productos.filter(p => !p.inventario.disponible).length },
    categorias,
    grupos_con_variantes: [...grupos].map(([producto_principal_uuid, variantes_uuids]) => ({ producto_principal_uuid, variantes_uuids })),
    productos
  };

  await fs.mkdir(path.dirname(SALIDA), { recursive: true });
  await fs.writeFile(SALIDA, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');
  console.log(`Catálogo generado: ${principales.length} productos principales y ${variantes.length} variantes.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
