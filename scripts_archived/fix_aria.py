import re

with open("src/routes/_authenticated.tsx", "r") as f:
    content = f.read()

# Line 160: title={isCollapsed ? "Expandir menu" : "Recolher menu"} -> add aria-label
content = content.replace(
    'title={isCollapsed ? "Expandir menu" : "Recolher menu"}',
    'title={isCollapsed ? "Expandir menu" : "Recolher menu"} aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}'
)

# Line 195: title="Busca rápida (⌘K)" -> add aria-label
content = content.replace(
    'title="Busca rápida (⌘K)"',
    'title="Busca rápida (⌘K)" aria-label="Busca rápida"'
)

with open("src/routes/_authenticated.tsx", "w") as f:
    f.write(content)

with open("src/routes/_authenticated.app.clientes.$clientId.tsx", "r") as f:
    content = f.read()

content = content.replace('title="Editar"', 'title="Editar" aria-label="Editar"')
content = content.replace('title={client.status === "active" ? "Arquivar" : "Reativar"}', 'title={client.status === "active" ? "Arquivar" : "Reativar"} aria-label={client.status === "active" ? "Arquivar" : "Reativar"}')
content = content.replace('title="Excluir"', 'title="Excluir" aria-label="Excluir"')
content = content.replace('title="Próxima sessão"', 'title="Próxima sessão" aria-label="Próxima sessão"')

with open("src/routes/_authenticated.app.clientes.$clientId.tsx", "w") as f:
    f.write(content)

