// Catálogo Valen Makeup: carga gradual, filtros y aviso automático de stock bajo.
const PRODUCTOS_POR_PAGINA = 24;
const STOCK_BAJO_MAXIMO = 2;

let productosPrincipales = [];
let productosVisibles = [];
let cantidadMostrada = PRODUCTOS_POR_PAGINA;

const contenedor = document.getElementById("contenedorProductos");
const mensajeCarga = document.getElementById("mensajeCarga");
const cantidadProductos = document.getElementById("cantidadProductos");
const buscador = document.getElementById("buscador");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroDisponibilidad = document.getElementById("filtroDisponibilidad");
const btnCargarMas = document.getElementById("btnCargarMas");
const cargarMasContenedor = document.getElementById("cargarMasContenedor");

async function cargarProductos() {
    try {
        const respuesta = await fetch("datos/productos.json");
        if (!respuesta.ok) throw new Error("No se pudo abrir productos.json");

        const datos = await respuesta.json();
        const todosLosProductos = datos.productos || [];
        productosPrincipales = todosLosProductos.filter(producto => producto.es_variante === false);

        productosPrincipales.forEach(producto => {
            producto.variantes = todosLosProductos.filter(variante => variante.grupo_uuid === producto.uuid);
        });

        llenarCategorias(productosPrincipales);
        filtrarProductos();
        mensajeCarga.style.display = "none";
    } catch (error) {
        mensajeCarga.textContent = "No se pudieron cargar los productos.";
        console.error(error);
    }
}

function llenarCategorias(productos) {
    const categorias = new Set();
    productos.forEach(producto => (producto.categorias || []).forEach(categoria => {
        if (categoria.nombre) categorias.add(categoria.nombre);
    }));
    [...categorias].sort((a, b) => a.localeCompare(b, "es")).forEach(categoria => {
        const opcion = document.createElement("option");
        opcion.value = categoria;
        opcion.textContent = categoria;
        filtroCategoria.appendChild(opcion);
    });
}

function mostrarPrecio(precio) {
    if (typeof precio !== "number") return "Consultar precio";
    return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(precio);
}

function obtenerCantidad(producto) {
    return typeof producto?.inventario?.cantidad === "number" ? producto.inventario.cantidad : null;
}

function disponibleIndividual(producto) {
    return producto?.inventario?.disponible !== false;
}

function disponibleProducto(producto) {
    if ((producto.variantes || []).length > 0) return producto.variantes.some(disponibleIndividual);
    return disponibleIndividual(producto);
}

function tieneUltimasUnidades(producto) {
    const opciones = (producto.variantes || []).length ? producto.variantes : [producto];
    return opciones.some(opcion => {
        const cantidad = obtenerCantidad(opcion);
        return disponibleIndividual(opcion) && cantidad !== null && cantidad > 0 && cantidad <= STOCK_BAJO_MAXIMO;
    });
}

function obtenerImagen(producto) {
    if (producto.imagenes?.length) return producto.imagenes[0];
    const varianteConImagen = (producto.variantes || []).find(variante => variante.imagenes?.length);
    return varianteConImagen ? varianteConImagen.imagenes[0] : "";
}

function crearEtiqueta(disponible, ultimas) {
    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta";
    if (!disponible) {
        etiqueta.classList.add("agotado");
        etiqueta.textContent = "Agotado";
    } else if (ultimas) {
        etiqueta.classList.add("ultimas");
        etiqueta.textContent = "Últimas unidades";
    } else {
        etiqueta.textContent = "Disponible";
    }
    return etiqueta;
}

function crearSelectorVariantes(producto) {
    if (!producto.variantes?.length) return null;
    const selector = document.createElement("select");
    selector.className = "variantes";
    selector.setAttribute("aria-label", "Seleccionar opción de " + producto.nombre);

    const inicial = document.createElement("option");
    inicial.textContent = "Seleccionar opción";
    inicial.value = "";
    selector.appendChild(inicial);

    producto.variantes.forEach(variante => {
        const opcion = document.createElement("option");
        const nombreOpcion = Object.values(variante.opciones || {}).filter(Boolean).join(" - ") || "Opción";
        const cantidad = obtenerCantidad(variante);
        let estado = "";
        if (!disponibleIndividual(variante)) estado = " - Agotado";
        else if (cantidad === 1) estado = " - Última unidad";
        else if (cantidad === 2) estado = " - Quedan 2";
        opcion.textContent = nombreOpcion + estado;
        opcion.disabled = !disponibleIndividual(variante);
        selector.appendChild(opcion);
    });
    return selector;
}

function crearTarjeta(producto) {
    const disponible = disponibleProducto(producto);
    const ultimas = disponible && tieneUltimasUnidades(producto);
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta";
    tarjeta.appendChild(crearEtiqueta(disponible, ultimas));

    const imagen = document.createElement("img");
    const rutaImagen = obtenerImagen(producto);
    imagen.alt = producto.nombre || "Producto Valen Makeup";
    imagen.loading = "lazy";
    imagen.decoding = "async";
    if (rutaImagen) imagen.src = rutaImagen;
    else imagen.style.display = "none";
    imagen.addEventListener("error", () => { imagen.style.display = "none"; });
    tarjeta.appendChild(imagen);

    const informacion = document.createElement("div");
    informacion.className = "informacion";

    const titulo = document.createElement("h2");
    titulo.textContent = producto.nombre || "Producto";
    informacion.appendChild(titulo);

    const categoria = document.createElement("p");
    categoria.className = "categoria";
    categoria.textContent = producto.categorias?.find(c => c.nombre)?.nombre || "Valen Makeup";
    informacion.appendChild(categoria);

    const precio = document.createElement("p");
    precio.className = "precio";
    precio.textContent = mostrarPrecio(producto.precio);
    informacion.appendChild(precio);

    const selector = crearSelectorVariantes(producto);
    if (selector) informacion.appendChild(selector);

    if (ultimas) {
        const nota = document.createElement("p");
        nota.className = "stock-nota";
        nota.textContent = "Confirmar disponibilidad antes del pago.";
        informacion.appendChild(nota);
    }

    if (disponible && producto.enlace_cuanto) {
        const boton = document.createElement("a");
        boton.className = "boton";
        boton.href = producto.enlace_cuanto;
        boton.target = "_blank";
        boton.rel = "noopener noreferrer";
        boton.textContent = "Ver producto";
        informacion.appendChild(boton);
    } else if (!disponible) {
        const agotado = document.createElement("p");
        agotado.className = "agotado";
        agotado.textContent = "Agotado";
        informacion.appendChild(agotado);
    }

    tarjeta.appendChild(informacion);
    return tarjeta;
}

function renderizarProductos() {
    contenedor.innerHTML = "";
    const visibles = productosVisibles.slice(0, cantidadMostrada);
    cantidadProductos.textContent = `Mostrando ${visibles.length} de ${productosVisibles.length} productos`;

    if (productosVisibles.length === 0) {
        contenedor.innerHTML = "<p>No se encontraron productos.</p>";
        cargarMasContenedor.hidden = true;
        return;
    }

    const fragmento = document.createDocumentFragment();
    visibles.forEach(producto => fragmento.appendChild(crearTarjeta(producto)));
    contenedor.appendChild(fragmento);
    cargarMasContenedor.hidden = visibles.length >= productosVisibles.length;
}

function filtrarProductos() {
    const texto = buscador.value.trim().toLowerCase();
    const categoria = filtroCategoria.value;
    const disponibilidad = filtroDisponibilidad.value;

    productosVisibles = productosPrincipales.filter(producto => {
        const coincideTexto = !texto || (producto.nombre || "").toLowerCase().includes(texto);
        const coincideCategoria = categoria === "todas" || (producto.categorias || []).some(c => c.nombre === categoria);
        const estaDisponible = disponibleProducto(producto);
        const coincideDisponibilidad = disponibilidad === "todos" || (disponibilidad === "disponibles" && estaDisponible) || (disponibilidad === "agotados" && !estaDisponible);
        return coincideTexto && coincideCategoria && coincideDisponibilidad;
    });
    cantidadMostrada = PRODUCTOS_POR_PAGINA;
    renderizarProductos();
}

buscador.addEventListener("input", filtrarProductos);
filtroCategoria.addEventListener("change", filtrarProductos);
filtroDisponibilidad.addEventListener("change", filtrarProductos);
btnCargarMas.addEventListener("click", () => { cantidadMostrada += PRODUCTOS_POR_PAGINA; renderizarProductos(); });
cargarProductos();
