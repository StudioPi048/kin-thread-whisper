with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

listener = """
  useEffect(() => {
    const handleEdgeDelete = async (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const relId = customEvent.detail;
      if (!relId) return;
      
      const { error } = await supabase.from("genogram_relationships").delete().eq("id", relId);
      if (!error) {
        toast({ title: "Vínculo removido", description: "O vínculo foi excluído." });
        query.refetch();
      }
    };
    window.addEventListener('delete-edge', handleEdgeDelete);
    return () => window.removeEventListener('delete-edge', handleEdgeDelete);
  }, [query]);
"""

content = content.replace(
    "const onConnect = useCallback(",
    listener + "\n  const onConnect = useCallback("
)

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)
