import secrets

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.utils.cache import patch_cache_control

from zerver.decorator import zulip_login_required
from zerver.lib.home import build_page_params_for_home_page_load, get_user_permission_info
from zerver.lib.request import RequestNotes


@zulip_login_required
def theater_view(request: HttpRequest) -> HttpResponse:
    """
    Theater Mode view - an immersive, narrative-focused frontend for RP sessions.
    Reuses the same state hydration as the main app but renders through a Svelte
    frontend with theatrical styling.
    """
    user_profile = request.user
    realm = user_profile.realm

    queue_id, page_params = build_page_params_for_home_page_load(
        request=request,
        user_profile=user_profile,
        realm=realm,
        insecure_desktop_app=False,
        narrow=[],
        narrow_stream=None,
        narrow_topic_name=None,
    )

    log_data = RequestNotes.get_notes(request).log_data
    if log_data is not None:
        log_data["extra"] = f"[theater:{queue_id}]"

    csp_nonce = secrets.token_hex(24)
    user_permission_info = get_user_permission_info(user_profile)

    response = render(
        request,
        "zerver/app/theater.html",
        context={
            "user_profile": user_profile,
            "page_params": page_params,
            "csp_nonce": csp_nonce,
            "color_scheme": user_permission_info.color_scheme,
        },
    )
    patch_cache_control(response, no_cache=True, no_store=True, must_revalidate=True)
    return response
