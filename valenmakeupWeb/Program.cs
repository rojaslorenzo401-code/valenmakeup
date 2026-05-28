var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Permite utilizar archivos como index.html, estilos.css, script.js y productos.json
app.UseDefaultFiles();
app.UseStaticFiles();

// Inicia la aplicación
app.Run();