package config

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

type MCP struct {
	Enabled            bool
	PublicURL, Issuer  string
	Username, Password string
	EnableReset        bool
	MaxConcurrent      int
}

func (c MCP) BaseURL() string          { return strings.TrimSuffix(c.PublicURL, "/mcp") }
func (c MCP) MetadataURL() string      { return c.BaseURL() + "/.well-known/oauth-protected-resource/mcp" }
func (c MCP) ConnectURL() string       { return c.BaseURL() + "/api/v1/mcp/connect" }
func (c MCP) AuthorizationURL() string { return c.BaseURL() + "/api/v1/mcp/oauth/authorize" }
func (c MCP) TokenURL() string         { return c.BaseURL() + "/oauth/token" }
func loadMCP(origins []string) (MCP, error) {
	c := MCP{PublicURL: value("AWCP_MCP_PUBLIC_URL", "http://127.0.0.1:2181/mcp"), Username: value("AWCP_MCP_USERNAME", "demo"), Password: value("AWCP_MCP_PASSWORD", "demo")}
	var err error
	if c.Enabled, err = strconv.ParseBool(value("AWCP_MCP_ENABLED", "true")); err != nil {
		return c, fmt.Errorf("AWCP_MCP_ENABLED must be boolean")
	}
	if !c.Enabled {
		return c, nil
	}
	if c.EnableReset, err = strconv.ParseBool(value("AWCP_MCP_RESET_ENABLED", "false")); err != nil {
		return c, fmt.Errorf("AWCP_MCP_RESET_ENABLED must be boolean")
	}
	if c.MaxConcurrent, err = strconv.Atoi(value("AWCP_MCP_MAX_CONCURRENT", "8")); err != nil || c.MaxConcurrent < 1 || c.MaxConcurrent > 64 {
		return c, fmt.Errorf("AWCP_MCP_MAX_CONCURRENT must be 1..64")
	}
	u, err := trustedURL(c.PublicURL)
	if err != nil || u.Path != "/mcp" {
		return c, fmt.Errorf("AWCP_MCP_PUBLIC_URL must be HTTPS ending in /mcp (HTTP allowed on loopback)")
	}
	if !loopback(u.Hostname()) && (c.Password == "demo" || len(c.Password) < 8) {
		return c, fmt.Errorf("set AWCP_MCP_PASSWORD (at least 8 characters) for a public demo")
	}
	if len(c.Username) > 128 || len(c.Password) > 1024 {
		return c, fmt.Errorf("MCP credentials too long")
	}
	c.Issuer = c.BaseURL()
	for _, origin := range origins {
		if origin == c.BaseURL() {
			return c, nil
		}
	}
	return c, fmt.Errorf("MCP public origin must be present in AWCP_ALLOWED_ORIGINS")
}
func loopback(host string) bool { return host == "127.0.0.1" || host == "localhost" || host == "::1" }
func trustedURL(raw string) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.RawPath != "" || strings.Contains(u.Path, "..") {
		return nil, fmt.Errorf("invalid URL")
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback(u.Hostname())) {
		return nil, fmt.Errorf("HTTPS required")
	}
	return u, nil
}
