import { listarClientes } from "@/lib/queries/clientes";
import { ClientesList } from "./ClientesList";

export default async function ClientesPage() {
  const clientes = await listarClientes();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Clientes</h1>
      <ClientesList clientes={clientes} />
    </div>
  );
}
