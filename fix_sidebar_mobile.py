with open("src/routes/_authenticated.tsx", "r") as f:
    content = f.read()

bottom_nav = """
        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-sidebar-border flex items-center justify-around z-50 px-2 safe-area-pb">
          {nav.map((item) => {
            const active = ("exact" in item && item.exact)
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  active ? "text-gold" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="size-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>
"""

content = content.replace(
    """        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>""",
    """        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative z-0">
          <Outlet />
        </main>
""" + bottom_nav + """
      </div>"""
)

with open("src/routes/_authenticated.tsx", "w") as f:
    f.write(content)
