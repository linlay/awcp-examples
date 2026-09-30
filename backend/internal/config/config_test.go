package config

import "testing"

func TestConfigRejectsInvalidOriginAndSecureHTTP(t *testing.T) {
	for _, origin := range []string{"*", "https://example.test/path", "https://user:password@example.test", "null"} {
		t.Setenv("AWCP_ALLOWED_ORIGINS", origin)
		if _, err := Load(); err == nil {
			t.Fatalf("accepted %q", origin)
		}
	}
	t.Setenv("AWCP_ALLOWED_ORIGINS", "http://127.0.0.1:2180")
	t.Setenv("AWCP_SECURE_COOKIE", "true")
	if _, err := Load(); err == nil {
		t.Fatal("secure cookie with HTTP accepted")
	}
	t.Setenv("AWCP_ALLOWED_ORIGINS", "https://demo.example")
	if _, err := Load(); err != nil {
		t.Fatal(err)
	}
}
