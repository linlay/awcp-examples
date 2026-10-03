package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	Address      string
	DatabasePath string
	StaticDir    string
	Origins      []string
	SecureCookie bool
	Profile      string
	MCP          MCP
}

// Load uses process environment over code defaults. .env is an operator input, not auto-loaded.
func Load() (Config, error) {
	c := Config{Address: value("AWCP_LISTEN", "127.0.0.1:2181"), DatabasePath: value("AWCP_DATABASE", "../data/awcp.sqlite"), StaticDir: value("AWCP_STATIC_DIR", "../frontend/dist"), Profile: value("AWCP_DATA_PROFILE", "acceptance")}
	var err error
	c.SecureCookie, err = strconv.ParseBool(value("AWCP_SECURE_COOKIE", "false"))
	if err != nil {
		return c, fmt.Errorf("AWCP_SECURE_COOKIE: %w", err)
	}
	for _, raw := range strings.Split(value("AWCP_ALLOWED_ORIGINS", "http://127.0.0.1:2180,http://127.0.0.1:2181"), ",") {
		origin := strings.TrimSpace(raw)
		u, err := url.Parse(origin)
		if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" || (u.Scheme != "http" && u.Scheme != "https") {
			return c, fmt.Errorf("invalid allowed origin %q", origin)
		}
		if c.SecureCookie && u.Scheme != "https" {
			return c, fmt.Errorf("secure cookies require HTTPS origins")
		}
		c.Origins = append(c.Origins, origin)
	}
	if c.Profile != "standard" && c.Profile != "acceptance" {
		return c, fmt.Errorf("AWCP_DATA_PROFILE must be standard or acceptance")
	}
	c.DatabasePath, err = filepath.Abs(c.DatabasePath)
	if err != nil {
		return c, err
	}
	c.StaticDir, err = filepath.Abs(c.StaticDir)
	if err == nil {
		c.MCP, err = loadMCP(c.Origins)
	}
	return c, err
}
func value(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
