"""
URL configuration for deals99_backend project.
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve


def health_status(request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "Deals99 API",
            "message": "Backend is running",
        }
    )


urlpatterns = [
    path('', health_status, name='health'),
    path('admin/', admin.site.urls),
    # Backwards-compatible API mounts
    path('api/', include('api.urls')),
    path('api/v1/', include('api.urls')),
    path('api/v1/admin/', include('admin_dashboard.urls')),
    path('api/admin/', include('admin_dashboard.urls')),
]

# Serve frontend static assets (HTML, CSS, JS, images) from the Frontend folder in DEBUG.
if settings.DEBUG:
    urlpatterns += [
        re_path(r'^(?P<path>.*\.html)$', serve, {'document_root': settings.BASE_DIR.parent.parent / 'Frontend'}),
        re_path(
            r'^(?P<path>.*\.(?:css|js|png|jpg|jpeg|svg|webp|webmanifest|json|ico))$',
            serve,
            {'document_root': settings.BASE_DIR.parent.parent / 'Frontend'},
        ),
    ]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
