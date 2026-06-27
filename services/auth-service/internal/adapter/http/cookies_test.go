package http

import "testing"

func TestMergeCookieHeaderReplacesOlderCookie(t *testing.T) {
	got := mergeCookieHeader(
		"csrf=flow; ory_kratos_session=old; preference=fr",
		[]string{
			"ory_kratos_session=new; Path=/; HttpOnly; SameSite=Lax",
			"csrf=next-flow; Path=/; HttpOnly",
		},
	)
	want := "csrf=next-flow; ory_kratos_session=new; preference=fr"
	if got != want {
		t.Fatalf("mergeCookieHeader() = %q, want %q", got, want)
	}
}

func TestMergeCookieHeaderKeepsValuesContainingEquals(t *testing.T) {
	got := mergeCookieHeader("token=abc==", nil)
	if got != "token=abc==" {
		t.Fatalf("mergeCookieHeader() = %q", got)
	}
}
