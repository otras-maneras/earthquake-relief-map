#!/usr/bin/env python3
import urllib.request
import urllib.parse
import json

API_URL = "http://localhost:4100/v1/puntos"

def get_nearby_puntos(lat, lng, radius_km=10):
    """
    Busca puntos de ayuda cercanos a una coordenada dada.
    """
    params = {
        "near": f"{lat},{lng}",
        "radius": radius_km,
        "limit": 50
    }
    query_string = urllib.parse.urlencode(params)
    url = f"{API_URL}?{query_string}"
    
    req = urllib.request.Request(
        url, 
        headers={"User-Agent": "AcopioVE-Python-Client/1.0"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                body = response.read().decode("utf-8")
                res = json.loads(body)
                return res.get("data", [])
    except Exception as e:
        print(f"Error al consultar la API: {e}")
        return []

if __name__ == "__main__":
    # Coordenadas de ejemplo (Caracas Centro)
    lat_caracas = 10.4806
    lng_caracas = -66.9036
    
    print(f"Buscando puntos de ayuda en un radio de 5km de Caracas...")
    puntos = get_nearby_puntos(lat_caracas, lng_caracas, radius_km=5)
    
    print(f"Encontrados {len(puntos)} puntos:")
    for p in puntos:
        distancia = p.get("descripcion", "") # Si near está activo, a veces describe la info o detalles
        print(f"- [{p['tipo'].upper()}] {p['nombre']}")
        if p.get("telefono"):
            print(f"  Contacto: {p['telefono']}")
        if p.get("fuente"):
            print(f"  Fuente: {p['fuente']}")
        print(f"  Coordenadas: {p['lat']}, {p['lng']}")
        print()
