// Aquí guardaremos los productos una vez que se carguen
let productosPrincipales = [];

// Elementos de la página que vamos a utilizar
const contenedor = document.getElementById("contenedorProductos");
const mensajeCarga = document.getElementById("mensajeCarga");
const cantidadProductos = document.getElementById("cantidadProductos");
const buscador = document.getElementById("buscador");
const filtroCategoria = document.getElementById("filtroCategoria");

// Esta función carga la información del archivo productos.json
async function cargarProductos() {
    try {
        const respuesta = await fetch("datos/productos.json");

        if (!respuesta.ok) {
            throw new Error("No se pudo abrir productos.json");
        }

        const datos = await respuesta.json();

        // Separamos productos principales y variantes
        const todosLosProductos = datos.productos;

        productosPrincipales = todosLosProductos.filter(producto => {
            return producto.es_variante === false;
        });

        // A cada producto principal le agregamos sus variantes
        productosPrincipales.forEach(producto => {
            producto.variantes = todosLosProductos.filter(variante => {
                return variante.grupo_uuid === producto.uuid;
            });
        });

        llenarCategorias(productosPrincipales);
        mostrarProductos(productosPrincipales);

        mensajeCarga.style.display = "none";

    } catch (error) {
        mensajeCarga.textContent = "No se pudieron cargar los productos.";
        console.error(error);
    }
}

// Esta función llena la lista de categorías
function llenarCategorias(productos) {
    const categorias = new Set();

    productos.forEach(producto => {
        producto.categorias.forEach(categoria => {
            if (categoria.nombre !== "") {
                categorias.add(categoria.nombre);
            }
        });
    });

    categorias.forEach(categoria => {
        const opcion = document.createElement("option");
        opcion.value = categoria;
        opcion.textContent = categoria;
        filtroCategoria.appendChild(opcion);
    });
}

// Esta función convierte un número en precio de Costa Rica
function mostrarPrecio(precio) {
    return new Intl.NumberFormat("es-CR", {
        style: "currency",
        currency: "CRC",
        maximumFractionDigits: 0
    }).format(precio);
}

// Esta función crea todas las tarjetas de productos
function mostrarProductos(productos) {
    contenedor.innerHTML = "";

    cantidadProductos.textContent = productos.length + " productos encontrados";

    if (productos.length === 0) {
        contenedor.innerHTML = "<p>No se encontraron productos.</p>";
        return;
    }

    productos.forEach(producto => {
        const tarjeta = document.createElement("article");
        tarjeta.classList.add("tarjeta");

        // Tomamos la primera imagen disponible
        let imagen = "https://via.placeholder.com/300x300?text=Sin+imagen";

        if (producto.imagenes.length > 0) {
            imagen = producto.imagenes[0];
        }

        // Buscamos el nombre de la categoría
        let categoria = "Sin categoría";

        if (producto.categorias.length > 0 && producto.categorias[0].nombre !== "") {
            categoria = producto.categorias[0].nombre;
        }

        // Revisamos si tiene unidades disponibles
        const disponible = producto.inventario.disponible;

        // Creamos el selector de variantes solamente si existen tonos o sabores
        let selectorVariantes = "";

        if (producto.variantes.length > 0) {
            selectorVariantes = `
                <select class="variantes">
                    <option>Seleccionar opcion</option>
                    ${producto.variantes.map(variante => {
                const opcion = Object.values(variante.opciones).join(" - ");
                const estado = variante.inventario.disponible ? "" : " - Agotado";

                return `<option>${opcion}${estado}</option>`;
            }).join("")}
                </select>
            `;
        }

        // Botón o mensaje según disponibilidad
        let accion = "";

        if (disponible) {
            if (producto.enlace_cuanto !== null) {
                accion = `
                    <a class="boton" href="${producto.enlace_cuanto}" target="_blank">
                        Ver producto
                    </a>
                `;
            } else {
                accion = `<p class="agotado">Producto disponible</p>`;
            }
        } else {
            accion = `<p class="agotado">Agotado</p>`;
        }

        // Armamos la tarjeta completa
        tarjeta.innerHTML = `
            <img src="${imagen}" alt="${producto.nombre}">

            <div class="informacion">
                <h2>${producto.nombre}</h2>
                <p class="categoria">${categoria}</p>
                <p class="precio">${mostrarPrecio(producto.precio)}</p>

                ${selectorVariantes}
                ${accion}
            </div>
        `;

        contenedor.appendChild(tarjeta);
    });
}

// Esta función busca productos por nombre y categoría
function filtrarProductos() {
    const textoBuscado = buscador.value.toLowerCase();
    const categoriaElegida = filtroCategoria.value;

    const productosFiltrados = productosPrincipales.filter(producto => {
        const coincideNombre = producto.nombre.toLowerCase().includes(textoBuscado);

        const coincideCategoria =
            categoriaElegida === "todas" ||
            producto.categorias.some(categoria => categoria.nombre === categoriaElegida);

        return coincideNombre && coincideCategoria;
    });

    mostrarProductos(productosFiltrados);
}

// Cuando la persona escribe o selecciona una categoría, filtramos
buscador.addEventListener("input", filtrarProductos);
filtroCategoria.addEventListener("change", filtrarProductos);

// Iniciamos la carga de productos
cargarProductos();