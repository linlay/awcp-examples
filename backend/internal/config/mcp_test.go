package config

import "testing"

func TestMCPDemoConfig(t *testing.T) {
	t.Setenv("AWCP_MCP_ENABLED", "true")
	t.Setenv("AWCP_MCP_PUBLIC_URL", "http://127.0.0.1:2181/mcp")
	t.Setenv("AWCP_MCP_PASSWORD", "demo")
	t.Setenv("AWCP_ALLOWED_ORIGINS", "http://127.0.0.1:2181")
	c, err := Load()
	if err != nil || c.MCP.Issuer != "http://127.0.0.1:2181" {
		t.Fatalf("local: %v", err)
	}
	t.Setenv("AWCP_MCP_PUBLIC_URL", "https://app.example/mcp")
	t.Setenv("AWCP_ALLOWED_ORIGINS", "https://app.example")
	if _, err = Load(); err == nil {
		t.Fatal("default password on public demo")
	}
	t.Setenv("AWCP_MCP_PASSWORD", "demo-test-password")
	if _, err = Load(); err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{"http://app.example/mcp", "https://app.example/mcp/", "https://app.example/mcp?token=x", "https://user:pass@app.example/mcp"} {
		t.Setenv("AWCP_MCP_PUBLIC_URL", raw)
		if _, err = Load(); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}
