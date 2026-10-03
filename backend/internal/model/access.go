package model

import "slices"

// Principal is populated exclusively by verified OAuth token introspection.
// It must never be decoded from tool arguments or HTTP JSON input.
type Principal struct {
	Issuer   string   `json:"issuer"`
	Subject  string   `json:"subject"`
	ClientID string   `json:"clientId"`
	Scopes   []string `json:"scopes"`
}

func (p Principal) HasScope(scope string) bool { return slices.Contains(p.Scopes, scope) }

// Access is a server-created credential, resolved again inside the data transaction.
// Exactly one of CookieHash and Principal must be supplied.
type Access struct {
	CookieHash string
	Principal  *Principal
}
