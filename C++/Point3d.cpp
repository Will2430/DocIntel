#include "Point3d.h"
#include "Vector3d.h"
#include <iostream>
using namespace std;

Point::Point(double x, double y, double z)
    : m_x{x}, m_y{y}, m_z{z}
{}

void Point::moveByVector(const Vector& v){
    m_x += v.m_x;
    m_y += v.m_y;
    m_z += v.m_z;
}

void Point::print() const{
    cout << "Point:(" << m_x << ", " << m_y << ", " << m_z << ")\n"; 
}
